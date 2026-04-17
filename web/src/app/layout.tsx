import "./globals.css";
import { DM_Sans, Montserrat } from "next/font/google";
import type { ReactNode } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { MobileNav } from "@/components/mobile-nav";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const montserratHeading = Montserrat({
  subsets: ["latin"],
  variable: "--font-heading",
});

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-sans" });

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={cn("font-sans", dmSans.variable, montserratHeading.variable)}
    >
      <body suppressHydrationWarning>
        <TooltipProvider>
          <SidebarProvider>
            <AppSidebar />
            {children}
          </SidebarProvider>
          <Toaster richColors position="top-right" />
          <MobileNav />
        </TooltipProvider>
      </body>
    </html>
  );
}
