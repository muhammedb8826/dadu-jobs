import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { HeaderUser } from "@/components/header-user"
import { UserType } from "@/lib/types/user.types"

function getAccountUrl(userType?: UserType) {
  if (userType === UserType.EMPLOYER) {
    return "/dashboard/employer-profile"
  }
  return "/dashboard/candidate-profile"
}

export function SiteHeader({
  user,
  userType,
}: {
  user?: {
    name: string
    email: string
    avatar: string
    initials?: string
  }
  userType?: UserType
}) {
  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base font-medium">
          {user ? `Welcome, ${user.name}` : "Welcome"}
        </h1>
        <div className="ml-auto flex items-center gap-2">
          {user && (
            <HeaderUser user={user} accountUrl={getAccountUrl(userType)} />
          )}
          <Separator
            orientation="vertical"
            className="h-4"
          />
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
