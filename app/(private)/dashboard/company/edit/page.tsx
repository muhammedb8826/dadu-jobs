import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { EmployerProfileCompletionForm } from "@/components/employer-profile-completion-form";
import { isEmployer } from "@/lib/auth/rbac";

export default async function EditCompanyPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  if (!isEmployer(session)) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      <header className="border-b bg-background px-6 py-4">
        <h1 className="text-xl font-semibold text-foreground">Edit Company</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Update your company details and social links
        </p>
      </header>

      <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-8">
        <section className="flex-1">
          <EmployerProfileCompletionForm sections={["company", "social"]} />
        </section>
      </div>
    </div>
  );
}
