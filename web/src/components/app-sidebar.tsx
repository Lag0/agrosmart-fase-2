"use client";

import {
  RiDashboardLine,
  RiFileChartLine,
  RiShieldLine,
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
  SidebarRail,
} from "@/components/ui/sidebar";

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
      isActive: true,
      items: [],
    },
    {
      title: "Upload",
      url: "/upload",
      icon: <RiUploadCloudLine />,
      items: [],
    },
    {
      title: "Relatório",
      url: "/report",
      icon: <RiFileChartLine />,
      items: [],
    },
    {
      title: "Auditoria",
      url: "/admin/audit",
      icon: <RiShieldLine />,
      items: [],
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="p-4">
        <span className="font-heading text-lg font-bold tracking-tight">
          AgroSmart
        </span>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
