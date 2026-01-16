"use client"

import * as React from "react"
import Link from "next/link"
import {
  IconBriefcase,
  IconChartBar,
  IconDashboard,
  IconFileText,
  IconHelp,
  IconInnerShadowTop,
  IconSearch,
  IconSettings,
  IconUser,
  IconUsers,
} from "@tabler/icons-react"
import { UserType } from "@/lib/types/user.types"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

// Candidate navigation items
const candidateNavMain = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: IconDashboard,
  },
  {
    title: "My Profile",
    url: "/dashboard/profile",
    icon: IconUser,
  },
  {
    title: "Application",
    url: "/dashboard/application",
    icon: IconFileText,
  },
]

// Employer navigation items
const employerNavMain = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: IconDashboard,
  },
  {
    title: "Job Postings",
    url: "/dashboard/jobs",
    icon: IconBriefcase,
  },
  {
    title: "Candidates",
    url: "/dashboard/candidates",
    icon: IconUsers,
  },
  {
    title: "Analytics",
    url: "/dashboard/analytics",
    icon: IconChartBar,
  },
]

const navSecondary = [
  {
    title: "Settings",
    url: "/dashboard/settings",
    icon: IconSettings,
  },
  {
    title: "Get Help",
    url: "/help",
    icon: IconHelp,
  },
  {
    title: "Search",
    url: "#",
    icon: IconSearch,
  },
]

// Get navigation items based on user type
function getNavItems(userType?: UserType) {
  if (userType === UserType.EMPLOYER) {
    return employerNavMain
  }
  // Default to candidate navigation
  return candidateNavMain
}

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  user?: {
    name: string
    email: string
    avatar: string
    initials?: string
  }
  userType?: UserType
}

export function AppSidebar({ 
  user,
  userType,
  ...props 
}: AppSidebarProps) {
  const navItems = getNavItems(userType)

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <Link href="/dashboard">
                <IconInnerShadowTop className="!size-5" />
                <span className="text-base font-semibold">Dadu Jobs</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navItems} />
        <NavSecondary items={navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user || { name: "User", email: "", avatar: "" }} />
      </SidebarFooter>
    </Sidebar>
  )
}
