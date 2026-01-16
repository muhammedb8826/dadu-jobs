import Link from "next/link";
import { RegistrationForm } from "@/features/registration";

export default function RegisterPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center px-4 py-12 bg-background">
      <div className="w-full space-y-6">
        <h1 className="text-3xl font-semibold text-foreground text-center">
          Create an account
        </h1>

        {/* Registration Form */}
        <RegistrationForm />
        <p className="text-sm text-muted-foreground text-center">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-primary hover:text-primary/80 transition-colors"
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
