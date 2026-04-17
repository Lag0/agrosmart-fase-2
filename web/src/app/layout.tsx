import "./globals.css";
import { DM_Sans, Merriweather } from "next/font/google";
import type { ReactNode } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";

const merriweatherHeading = Merriweather({
  subsets: ["latin"],
  variable: "--font-heading",
});

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-sans" });

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={cn("font-sans", dmSans.variable, merriweatherHeading.variable)}
    >
      <body>
        <TooltipProvider>
          <SidebarProvider>
            <AppSidebar />
            {children}
          </SidebarProvider>
          <Toaster richColors position="top-right" />
        </TooltipProvider>
      </body>
    </html>
  );
}
