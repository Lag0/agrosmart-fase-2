import "./globals.css";
import type { Metadata } from "next";
import { DM_Sans, Merriweather } from "next/font/google";
import { cn } from "@/lib/utils";

const merriweatherHeading = Merriweather({
  subsets: ["latin"],
  variable: "--font-heading",
});

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "AgroSmart Fase 2",
  description: "Plant health dashboard and analysis workflow",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="pt-BR"
      className={cn("font-sans", dmSans.variable, merriweatherHeading.variable)}
    >
      <body>{children}</body>
    </html>
  );
}
