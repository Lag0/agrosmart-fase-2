"use client";

import {
  RiDashboardLine,
  RiFileChartLine,
  RiLeafLine,
  RiListCheck3,
  RiSideBarLine,
  RiUploadCloudLine,
} from "@remixicon/react";
import type * as React from "react";
import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const data = {
  user: {
    name: "AgroSmart",
    email: "fase2@agrosmart.local",
    avatar: "",
  },
  navMain: [
    {
      title: "Dashboard",
      url: "/",
      icon: <RiDashboardLine />,
    },
    {
      title: "Upload",
      url: "/upload",
      icon: <RiUploadCloudLine />,
    },
    {
      title: "Relatório",
      url: "/report",
      icon: <RiFileChartLine />,
    },
    {
      title: "Análises",
      url: "/analyses",
      icon: <RiListCheck3 />,
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="p-4">
        <div
          className={cn(
            "flex items-center gap-2",
            collapsed && "justify-center",
          )}
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <RiLeafLine className="size-4" />
          </div>
          {!collapsed && (
            <span className="font-heading text-lg font-bold tracking-tight transition-opacity duration-200">
              AgroSmart
            </span>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
        <button
          onClick={toggleSidebar}
          className={cn(
            "mx-auto flex size-8 items-center justify-center rounded-lg text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            collapsed ? "mt-2" : "mt-1",
          )}
          aria-label={collapsed ? "Expandir sidebar" : "Recolher sidebar"}
        >
          <RiSideBarLine className="size-4" />
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
