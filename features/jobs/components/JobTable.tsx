"use client";

import * as React from "react";
import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { MoreHorizontal, Pencil, Eye } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Job } from "../types/job.types";

function getStatusBadge(status: string) {
  switch (status?.toLowerCase()) {
    case "approved":
      return (
        <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20">
          Approved
        </Badge>
      );
    case "rejected":
      return (
        <Badge className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20">
          Rejected
        </Badge>
      );
    case "pending":
      return (
        <Badge className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20">
          Pending
        </Badge>
      );
    default:
      return (
        <Badge variant="outline">
          {status || "Unknown"}
        </Badge>
      );
  }
}

function formatSalary(salary?: Job["salary"]): string {
  if (!salary) return "Not specified";
  
  if (salary.isNegotiable) {
    return `Negotiable (${salary.currency})`;
  }

  if (salary.min && salary.max) {
    return `${salary.min.toLocaleString()} - ${salary.max.toLocaleString()} ${salary.currency}`;
  }

  if (salary.min) {
    return `From ${salary.min.toLocaleString()} ${salary.currency}`;
  }

  if (salary.max) {
    return `Up to ${salary.max.toLocaleString()} ${salary.currency}`;
  }

  return "Not specified";
}

export const jobColumns: ColumnDef<Job>[] = [
  {
    accessorKey: "title",
    header: "Job Title",
    cell: ({ row }) => {
      const job = row.original;
      return (
        <div className="flex flex-col">
          <div className="font-medium">{job.title}</div>
          {job.jobCode && (
            <div className="text-xs text-muted-foreground">
              Code: {job.jobCode}
            </div>
          )}
          {job.categories && job.categories.length > 0 && (
            <div className="text-xs text-muted-foreground mt-1">
              {job.categories.map((cat) => cat.name).join(", ")}
            </div>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "company",
    header: "Company",
    cell: ({ row }) => {
      const company = row.original.company;
      return company ? (
        <div className="font-medium">{company.name}</div>
      ) : (
        <span className="text-muted-foreground">—</span>
      );
    },
  },
  {
    accessorKey: "location",
    header: "Location",
    cell: ({ row }) => {
      const location = row.original.location;
      return location || <span className="text-muted-foreground">—</span>;
    },
  },
  {
    accessorKey: "workplaceType",
    header: "Workplace",
    cell: ({ row }) => {
      return <Badge variant="outline">{row.original.workplaceType}</Badge>;
    },
  },
  {
    accessorKey: "salary",
    header: "Salary",
    cell: ({ row }) => {
      return (
        <div className="text-sm">
          {formatSalary(row.original.salary)}
        </div>
      );
    },
  },
  {
    accessorKey: "deadline",
    header: "Deadline",
    cell: ({ row }) => {
      const deadline = new Date(row.original.deadline);
      const isPast = deadline < new Date();
      return (
        <div className={`text-sm ${isPast ? "text-red-600 dark:text-red-400" : ""}`}>
          {deadline.toLocaleDateString()}
        </div>
      );
    },
  },
  {
    accessorKey: "approvalStatus",
    header: "Status",
    cell: ({ row }) => {
      return getStatusBadge(row.original.approvalStatus);
    },
  },
  {
    accessorKey: "isFeatured",
    header: "Featured",
    cell: ({ row }) => {
      return row.original.isFeatured ? (
        <Badge variant="outline">Featured</Badge>
      ) : (
        <span className="text-muted-foreground">—</span>
      );
    },
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => {
      const job = row.original;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/dashboard/jobs/${job.id}/edit`} className="flex items-center">
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/jobs/${job.slug}`} className="flex items-center">
                <Eye className="mr-2 h-4 w-4" />
                View
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];

interface JobTableProps {
  jobs: Job[];
}

export function JobTable({ jobs }: JobTableProps) {
  return (
    <DataTable
      columns={jobColumns}
      data={jobs}
      searchKey="title"
      searchPlaceholder="Search jobs by title..."
      emptyMessage="No jobs found."
      enableColumnVisibility={true}
    />
  );
}
