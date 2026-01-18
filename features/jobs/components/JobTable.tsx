"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { MoreHorizontal, Pencil, Eye, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
    accessorKey: "isActive",
    header: "Active",
    cell: ({ row }) => {
      const isActive = row.original.isActive;
      return isActive ? (
        <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20">
          Active
        </Badge>
      ) : (
        <Badge className="bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20">
          Inactive
        </Badge>
      );
    },
  },
];

interface JobTableProps {
  jobs: Job[];
}

function DeleteJobButton({ job }: { job: Job }) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const jobId = job.documentId || job.id;
      const response = await fetch(`/api/jobs?id=${jobId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete job");
      }

      toast.success("Job deleted successfully");
      setOpen(false);
      router.refresh();
    } catch (error) {
      console.error("Delete error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to delete job");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            setOpen(true);
          }}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the job
            posting <strong>&quot;{job.title}&quot;</strong> and all associated data.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function JobTable({ jobs }: JobTableProps) {
  const columnsWithDelete: ColumnDef<Job>[] = [
    ...jobColumns, // Include all columns including isActive
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
                <Link href={`/dashboard/jobs/${job.documentId || job.id}/edit`} className="flex items-center">
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
              <DropdownMenuSeparator />
              <DeleteJobButton job={job} />
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return (
    <DataTable
      columns={columnsWithDelete}
      data={jobs}
      searchKey="title"
      searchPlaceholder="Search jobs by title..."
      emptyMessage="No jobs found."
      enableColumnVisibility={true}
    />
  );
}
