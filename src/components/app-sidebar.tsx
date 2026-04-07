import {
  IconBell,
  IconCar,
  IconCash,
  IconCoin,
  IconDashboard,
  IconFile,
  IconFileText,
  IconGift,
  IconGiftCard,
  IconHeadset,
  IconMapPin,
  IconMotorbike,
  IconPackage,
  IconLink,
  IconPlane,
  IconReceipt,
  IconSettings,
  IconShoppingBag,
  IconShoppingCart,
  IconTicket,
  IconTruckDelivery,
  IconUsers,
  IconUserShield,
  IconWorld,
} from "@tabler/icons-react";

import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useCurrentUser } from "@/contexts/UserContext";
import { Link } from "react-router-dom";

const data = {
  navMain: [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: IconDashboard,
    },
    {
      title: "Users",
      url: "/users",
      icon: IconUsers,
    },
    {
      title: "Riders",
      url: "/riders",
      icon: IconMotorbike,
    },
    {
      title: "Restaurants",
      url: "/vendors",
      icon: IconTruckDelivery,
    },
    {
      title: "Fees",
      url: "/fees",
      icon: IconCoin,
    },
    {
      title: "Referrals",
      url: "/referrals",
      icon: IconGift,
    },
    {
      title: "Withdrawals",
      url: "/withdrawals",
      icon: IconCash,
    },
    {
      title: "Coupons",
      url: "/coupons",
      icon: IconGiftCard,
    },
    {
      title: "Generated Referrals",
      url: "/generated",
      icon: IconLink,
    },
    {
      title: "Support Tickets",
      url: "/support-tickets",
      icon: IconHeadset,
    },
    {
      title: "Restaurant Orders",
      url: "/restaurant-orders",
      icon: IconShoppingCart,
    },
    {
      title: "Shipment Orders",
      url: "/shipment-orders",
      icon: IconPlane,
    },
    {
      title: "Ride Hailing",
      url: "/ride-hailing",
      icon: IconCar,
    },
    {
      title: "Export Rates",
      url: "/export-rates",
      icon: IconPlane,
    },
    {
      title: "Delivery Zones",
      url: "/delivery-zones",
      icon: IconMapPin,
    },
    {
      title: "E-commerce Merchants",
      url: "/ecommerce-merchants",
      icon: IconShoppingBag,
    },
    {
      title: "Product Orders",
      url: "/product-orders",
      icon: IconShoppingCart,
    },
    {
      title: "General Notifications",
      url: "/general-notifications",
      icon: IconBell,
    },
    {
      title: "DHL Zones",
      url: "/dhl-zones",
      icon: IconWorld,
    },
    {
      title: "App Config",
      url: "/app-config",
      icon: IconSettings,
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user } = useCurrentUser();
  const adminType = user?.adminType || "customercare";

  let navItems = [...data.navMain];

  if (adminType === "customercare") {
    const allowedTitles = [
      "Dashboard",
      "Users",
      "Riders",
      "Restaurants",
      "E-commerce Merchants",
      "Support Tickets",
      "Restaurant Orders",
      "Shipment Orders",
      "Ride Hailing",
      "Coupons",
      "Product Orders",
    ];
    navItems = navItems.filter((item) => allowedTitles.includes(item.title));
  } else if (adminType === "verifier") {
    // Verifiers can only access Riders
    const allowedTitles = ["Riders"];
    navItems = navItems.filter((item) => allowedTitles.includes(item.title));
  } else if (adminType === "super") {
    // Add User Management for super admin
    navItems.splice(1, 0, {
      title: "User Management",
      url: "/admin/users",
      icon: IconUserShield,
    });
  }

  // Exclude certain items for non-super admins
  if (adminType !== "super") {
    const excludedTitles = [
      "DHL Zones",
      "Fees",
      "Delivery Zones",
      "Export Rates",
    ];
    navItems = navItems.filter((item) => !excludedTitles.includes(item.title));
  }

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <Link to="/dashboard">
                <IconTruckDelivery className="!size-5" />
                <span className="text-base font-semibold">PushNDeliver</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navItems} />
      </SidebarContent>
      <SidebarFooter>
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
