import type { ReactNode } from "react";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: ReactNode;
}

export function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <CardHeader>
      <div className="flex items-center justify-between">
        <div>
          <CardTitle>{title}</CardTitle>
          {description && (
            <p className="text-muted-foreground mt-1 text-sm">{description}</p>
          )}
        </div>
        {children}
      </div>
    </CardHeader>
  );
}

interface PageShellProps {
  children: ReactNode;
}

export function PageShell({ children }: PageShellProps) {
  return <CardContent className="p-6">{children}</CardContent>;
}
