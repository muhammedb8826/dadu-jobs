import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { JobPostingForm } from "@/components/job-posting-form";
import { isEmployer } from "@/lib/auth/rbac";

export default async function EditJobPostingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  // Role-based access: Only employers can edit job postings
  if (!isEmployer(session)) {
    redirect("/dashboard");
  }

  const { id } = await params;
  const jobId = parseInt(id, 10);

  if (isNaN(jobId)) {
    redirect("/dashboard/jobs");
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      {/* Page header */}
      <header className="border-b bg-background px-6 py-4">
        <h1 className="text-xl font-semibold text-foreground">
          Edit Job Posting
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Update the details of your job posting
        </p>
      </header>

      {/* Main content */}
      <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-8">
        <section className="flex-1">
          <JobPostingForm jobId={jobId} />
        </section>
      </div>
    </div>
  );
}
