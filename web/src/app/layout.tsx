import "./globals.css";
import { DM_Sans, Merriweather } from "next/font/google";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import AppShell from "@/shared/components/layout/app-shell";

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
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
