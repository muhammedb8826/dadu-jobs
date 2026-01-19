import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Briefcase } from "lucide-react";
import { isEmployer } from "@/lib/auth/rbac";
import { JobTable, getJobs } from "@/features/jobs";


export default async function JobsPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  // Role-based access: Only employers can view job postings
  if (!isEmployer(session)) {
    redirect("/dashboard");
  }

  const jobs = await getJobs(Number(session.userId), session.jwt);

  // Debug: Log jobs to see what's being fetched
  console.log("Fetched jobs:", jobs);
  console.log("Jobs count:", jobs.length);
  console.log("User ID:", session.userId);

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      {/* Page header */}
      <header className="flex items-center justify-between border-b bg-background px-6 py-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Job Postings
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your job postings and applications
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/jobs/new">
            <Plus className="mr-2 h-4 w-4" />
            New Job Posting
          </Link>
        </Button>
      </header>

      {/* Main content */}
      <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-8">
        {jobs.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Briefcase className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No job postings yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Get started by creating your first job posting
              </p>
              <Button asChild>
                <Link href="/dashboard/jobs/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Job Posting
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <JobTable jobs={jobs} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
