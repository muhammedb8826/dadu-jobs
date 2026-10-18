import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { getRawSession, getSession, parseUserType, validateSession } from "@/lib/auth/session";
import { SessionHealer } from "@/components/session-healer";
import { redirect } from "next/navigation";

/** Session-backed routes must not be statically prerendered at build time. */
export const dynamic = "force-dynamic";

function getInitials(firstName: string, email: string): string {
  if (firstName) {
    return firstName.substring(0, 2).toUpperCase();
  }
  return email.substring(0, 2).toUpperCase();
}

export default async function PrivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  // Validate session with Strapi to ensure JWT token is still valid
  // This protects all private routes from invalid/deleted user sessions
  const isValid = await validateSession(session);
  if (!isValid) {
    // Session is invalid (user deleted or token expired), redirect to logout route
    // The logout route handler will clear the session cookie
    redirect("/api/auth/logout");
  }

  // Persist healed userType into the cookie when the raw cookie is missing it
  const rawSession = await getRawSession();
  const needsHeal = !parseUserType(rawSession?.userType);

  const user = {
    name: session.firstName || "User",
    email: session.email,
    avatar: "",
    initials: getInitials(session.firstName, session.email),
  };
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <SessionHealer needsHeal={needsHeal} />
      <AppSidebar variant="inset" user={user} userType={session.userType} />
      <SidebarInset>
        <SiteHeader user={user} userType={session.userType} />
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
