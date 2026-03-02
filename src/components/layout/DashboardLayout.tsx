import type { ReactNode } from "react";

interface DashboardLayoutProps {
  sidebar: ReactNode;
  header: ReactNode;
  children: ReactNode;
}

export function DashboardLayout({ sidebar, header, children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-transparent text-dune-950 dark:text-gray-50">
      <div className="mx-auto flex max-w-[1600px] gap-6 p-4 md:p-6">
        <aside className="hidden w-64 shrink-0 md:block">{sidebar}</aside>
        <div className="min-w-0 flex-1 space-y-6">
          {header}
          <main className="space-y-6 pb-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
