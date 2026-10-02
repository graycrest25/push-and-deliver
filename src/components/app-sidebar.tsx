import { IconArrowUpRight } from "@tabler/icons-react";
import { Link } from "react-router-dom";
import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { useCurrentUser } from "@/contexts/UserContext";
import { adminHome } from "@/lib/admin-access";
import { allowedNavigation } from "@/lib/navigation";

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const { user } = useCurrentUser();
  const items = user?.isAdmin ? allowedNavigation(user.adminType) : [];
  return (
    <Sidebar collapsible="offcanvas" className="workspace-sidebar" {...props}>
      <SidebarHeader className="px-5 py-6">
        <Link
          to={adminHome(user?.adminType)}
          className="brand-lockup"
          aria-label="PushNDeliver home"
        >
          <img src="/logo.png" alt="" width={40} height={40} className="brand-logo" />
          <span className="text-lg font-bold tracking-tight">
            PushNDeliver
            <span className="block text-xs font-normal tracking-normal text-sidebar-foreground/70">
              Admin workspace
            </span>
          </span>
          <IconArrowUpRight
            size={16}
            className="ml-auto text-sidebar-foreground/50"
          />
        </Link>
      </SidebarHeader>
      <SidebarContent className="px-3 pb-4">
        <NavMain items={items} />
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-3">
        <NavUser
          user={{
            name: user?.username || "Admin",
            email: user?.email || "",
            avatar: user?.imageURL || "",
          }}
        />
      </SidebarFooter>
    </Sidebar>
  );
}
