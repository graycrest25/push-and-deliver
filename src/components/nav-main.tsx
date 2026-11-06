import type { NavigationItem } from "@/lib/navigation";
import { IconCirclePlusFilled, IconChevronDown } from "@tabler/icons-react";
import { Link, useLocation } from "react-router-dom";
import { useEffect, useId, useState } from "react";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  useSidebar,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { useCurrentUser } from "@/contexts/UserContext";

export function NavMain({
  items,
}: {
  items: (NavigationItem & { children: NavigationItem[] })[];
}) {
  const { user } = useCurrentUser();
  const adminType = user?.adminType || "customercare";
  const isValidAdmin =
    user?.isAdmin === true &&
    (user.adminType === "super" || user.adminType === "regular");

  return (
    <SidebarGroup className="p-0">
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          <SidebarMenuItem className="flex items-center gap-2">
            {adminType !== "customercare" && isValidAdmin && (
              <SidebarMenuButton
                asChild
                className="mb-3 h-10 border border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground"
              >
                <Link to="/coupons">
                  <IconCirclePlusFilled />
                  <span>Coupon campaigns</span>
                </Link>
              </SidebarMenuButton>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
        {Array.from(
          new Set(items.map((item) => item.group || "Workspace")),
        ).map((group) => (
          <div key={group} className="navigation-section">
            <SidebarGroupLabel className="px-3 text-xs font-medium text-sidebar-foreground/70">
              {group}
            </SidebarGroupLabel>
            <SidebarMenu className="gap-1">
              {items
                .filter((item) => (item.group || "Workspace") === group)
                .map((item) => (
                  <NavigationDestination key={item.url} item={item} />
                ))}
            </SidebarMenu>
          </div>
        ))}
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function NavigationDestination({
  item,
}: {
  item: NavigationItem & { children: NavigationItem[] };
}) {
  const location = useLocation();
  const { setOpenMobile, isMobile } = useSidebar();
  const submenuId = useId();
  const matches = (url: string) =>
    location.pathname === url || location.pathname.startsWith(`${url}/`);
  const active =
    matches(item.url) || item.children.some((child) => matches(child.url));
  const [open, setOpen] = useState(active);
  useEffect(() => {
    if (active) setOpen(true);
  }, [location.pathname, active]);
  const closeMobile = () => {
    if (isMobile) setOpenMobile(false);
  };
  if (!item.children.length)
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          isActive={active}
          tooltip={item.title}
          asChild
          className="nav-destination"
        >
          <Link
            to={item.url}
            aria-current={active ? "page" : undefined}
            onClick={closeMobile}
          >
            {item.icon && <item.icon stroke={1.7} />}
            <span>{item.title}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        type="button"
        isActive={active}
        tooltip={item.title}
        className="nav-destination"
        aria-expanded={open}
        aria-controls={submenuId}
        onClick={() => setOpen((value) => !value)}
      >
        {item.icon && <item.icon stroke={1.7} />}
        <span>{item.title}</span>
        <IconChevronDown
          className={`ml-auto transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
          size={16}
        />
      </SidebarMenuButton>
      {open && (
        <SidebarMenuSub id={submenuId} aria-label={`${item.title} subsections`}>
          {[
            { ...item, title: `All ${item.title.toLowerCase()}` },
            ...item.children,
          ].map((child) => (
            <SidebarMenuSubItem key={child.url}>
              <SidebarMenuSubButton asChild isActive={matches(child.url)}>
                <Link
                  to={child.url}
                  onClick={closeMobile}
                  aria-current={matches(child.url) ? "page" : undefined}
                >
                  <span>{child.title}</span>
                </Link>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          ))}
        </SidebarMenuSub>
      )}
    </SidebarMenuItem>
  );
}
