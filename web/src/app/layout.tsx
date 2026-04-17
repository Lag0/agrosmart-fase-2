import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AgroSmart Fase 2",
  description: "Plant health dashboard and analysis workflow",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
