import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { IconChevronRight, IconArrowsExchange } from "@tabler/icons-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/contexts/UserContext";
import { TransactModal } from "@/components/TransactModal";
import { PageFinder } from "@/components/page-finder";
import { ThemeToggle } from "@/components/theme-toggle";
import { adminRoleLabels, navigationForPath } from "@/lib/navigation";

export function Layout({ children }: { children: React.ReactNode }) {
  const { user } = useCurrentUser();
  const location = useLocation();
  const current = navigationForPath(location.pathname);
  const isDetail = current && location.pathname !== current.url;
  const [transactModalOpen, setTransactModalOpen] = useState(false);
  return (
    <SidebarProvider
      style={{ "--sidebar-width": "16.5rem" } as React.CSSProperties}
    >
      <a href="#workspace-content" className="skip-link">
        Skip to content
      </a>
      <AppSidebar />
      <main className="workspace-main min-w-0 flex-1">
        <header className="workspace-header">
          <div className="flex min-w-0 items-center gap-3">
            <SidebarTrigger aria-label="Toggle navigation" />
            <span className="h-5 w-px bg-border" aria-hidden="true" />
            <nav
              aria-label="Breadcrumb"
              className="flex min-w-0 items-center gap-2 text-sm"
            >
              {isDetail ? (
                <>
                  <Link
                    to={current.url}
                    className="truncate text-muted-foreground hover:text-primary"
                  >
                    {current.title}
                  </Link>
                  <IconChevronRight
                    size={14}
                    className="shrink-0 text-muted-foreground"
                  />
                  <span className="font-medium" aria-current="page">
                    Details
                  </span>
                </>
              ) : (
                <span className="truncate font-medium" aria-current="page">
                  {current?.title || "Workspace"}
                </span>
              )}
            </nav>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <PageFinder />
            <span className="role-badge hidden xl:inline-flex">
              {adminRoleLabels[user?.adminType || ""] || "Admin"}
            </span>
            <ThemeToggle />
            {user?.adminType === "super" && (
              <Button size="sm" onClick={() => setTransactModalOpen(true)}>
                <IconArrowsExchange />
                <span className="hidden sm:inline">Transact</span>
                <span className="sr-only sm:hidden">Transact</span>
              </Button>
            )}
          </div>
        </header>
        <div id="workspace-content" tabIndex={-1} className="app-content">
          {children}
        </div>
        <footer className="workspace-footer">
          <span>PushNDeliver workspace</span>
          <span>{adminRoleLabels[user?.adminType || ""] || "Admin"}</span>
        </footer>
      </main>
      <TransactModal
        open={transactModalOpen}
        onOpenChange={setTransactModalOpen}
      />
    </SidebarProvider>
  );
}
