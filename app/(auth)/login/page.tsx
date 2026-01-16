import Link from "next/link";
import { LoginForm } from "@/features/auth";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center px-4 py-12 bg-background">
      <div className="w-full space-y-6">
          <h1 className="text-3xl font-semibold text-foreground text-center">Welcome back</h1>

        {/* Login Form */}
        <LoginForm />
        <p className="text-sm text-muted-foreground text-center">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="font-medium text-primary hover:text-primary/80 transition-colors"
          >
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}
