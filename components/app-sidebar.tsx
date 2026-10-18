"use client"

import * as React from "react"
import Link from "next/link"
import {
  IconBookmark,
  IconBriefcase,
  IconChartBar,
  IconDashboard,
  IconFileText,
  IconHelp,
  IconInnerShadowTop,
  IconSearch,
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

const candidateNavMain = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: IconDashboard,
  },
  {
    title: "Browse Jobs",
    url: "/dashboard/browse-jobs",
    icon: IconSearch,
  },
  {
    title: "Applications",
    url: "/dashboard/applications",
    icon: IconBriefcase,
  },
  {
    title: "Saved Jobs",
    url: "/dashboard/saved-jobs",
    icon: IconBookmark,
  },
  {
    title: "My Profile",
    url: "/dashboard/candidate-profile",
    icon: IconFileText,
  },
]

const employerNavMain = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: IconDashboard,
  },
  {
    title: "Employer Profile",
    url: "/dashboard/employer-profile",
    icon: IconFileText,
  },
  {
    title: "Job Postings",
    url: "/dashboard/jobs",
    icon: IconBriefcase,
  },
  {
    title: "Applications",
    url: "/dashboard/applications",
    icon: IconFileText,
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
    title: "Get Help",
    url: "/faq",
    icon: IconHelp,
  },
]

function getNavItems(userType?: UserType) {
  if (userType === UserType.EMPLOYER) {
    return employerNavMain
  }
  return candidateNavMain
}

function getAccountUrl(userType?: UserType) {
  if (userType === UserType.EMPLOYER) {
    return "/dashboard/employer-profile"
  }
  return "/dashboard/candidate-profile"
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
  const accountUrl = getAccountUrl(userType)

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <Link href="/dashboard">
                <IconInnerShadowTop className="size-5!" />
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
        <NavUser
          user={user || { name: "User", email: "", avatar: "" }}
          accountUrl={accountUrl}
        />
      </SidebarFooter>
    </Sidebar>
  )
}
