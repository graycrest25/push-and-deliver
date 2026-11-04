import {
  IconBell,
  IconCar,
  IconCash,
  IconCoin,
  IconDashboard,
  IconGift,
  IconGiftCard,
  IconStopwatch,
  IconHeadset,
  IconLink,
  IconMapPin,
  IconMotorbike,
  IconPlane,
  IconSettings,
  IconShoppingBag,
  IconShoppingCart,
  IconTruckDelivery,
  IconUsers,
  IconUserShield,
  IconWorld,
  type Icon,
} from "@tabler/icons-react";
import { canAccessAdminScreen } from "@/lib/admin-access";

export interface NavigationItem {
  title: string;
  url: string;
  icon: Icon;
  group: string;
  parentUrl?: string;
}

export const navigation: NavigationItem[] = [
  {
    title: "Rider applications",
    url: "/rider-applications",
    icon: IconMotorbike,
    group: "People & partners",
  },
  {
    title: "Pricing audit",
    url: "/pricing-audit",
    icon: IconCoin,
    group: "Finance",
  },
  {
    title: "Report coverage",
    url: "/analytics-coverage",
    icon: IconDashboard,
    group: "Workspace",
    parentUrl: "/reports",
  },
  {
    title: "Account & order reports",
    url: "/reports",
    icon: IconDashboard,
    group: "Workspace",
  },
  {
    title: "Background jobs",
    url: "/jobs",
    icon: IconSettings,
    group: "Administration",
  },
  {
    title: "Files",
    url: "/files",
    icon: IconShoppingBag,
    group: "Administration",
  },
  {
    title: "Payment review",
    url: "/payments",
    icon: IconCash,
    group: "Finance",
  },
  {
    title: "Audit history",
    url: "/audit",
    icon: IconUserShield,
    group: "Administration",
  },
  {
    title: "Account security",
    url: "/settings",
    icon: IconSettings,
    group: "Administration",
  },
  {
    title: "Weekly overview",
    url: "/weekly-overview",
    icon: IconDashboard,
    group: "Workspace",
    parentUrl: "/dashboard",
  },
  {
    title: "Overview",
    url: "/dashboard",
    icon: IconDashboard,
    group: "Workspace",
  },
  {
    title: "Shipment orders",
    url: "/shipment-orders",
    icon: IconPlane,
    group: "Operations",
  },
  {
    title: "Ride hailing",
    url: "/ride-hailing",
    icon: IconCar,
    group: "Operations",
  },
  {
    title: "Support tickets",
    url: "/support-tickets",
    icon: IconHeadset,
    group: "Operations",
  },
  {
    title: "Users",
    url: "/users",
    icon: IconUsers,
    group: "People & partners",
  },
  {
    title: "User activation",
    url: "/user-activation",
    icon: IconDashboard,
    group: "People & partners",
    parentUrl: "/users",
  },
  {
    title: "Weekly concentration",
    url: "/weekly-concentration",
    icon: IconDashboard,
    group: "People & partners",
    parentUrl: "/users",
  },
  {
    title: "Riders",
    url: "/riders",
    icon: IconMotorbike,
    group: "People & partners",
  },
  {
    title: "Weekly deliveries",
    url: "/rider-weekly-deliveries",
    icon: IconMotorbike,
    group: "People & partners",
    parentUrl: "/riders",
  },
  {
    title: "Vendor applications",
    url: "/vendors",
    icon: IconTruckDelivery,
    group: "People & partners",
  },
  {
    title: "Withdrawals",
    url: "/withdrawals",
    icon: IconCash,
    group: "Finance",
  },
  { title: "Fees & pricing", url: "/fees", icon: IconCoin, group: "Finance" },
  {
    title: "Shipping tariffs",
    url: "/export-rates",
    icon: IconPlane,
    group: "Finance",
  },
  {
    title: "Game rules",
    url: "/game-rules",
    icon: IconStopwatch,
    group: "Growth",
  },
  { title: "Coupons", url: "/coupons", icon: IconGiftCard, group: "Growth" },
  {
    title: "Redemption metrics",
    url: "/coupon-redemption-metrics",
    icon: IconGiftCard,
    group: "Growth",
    parentUrl: "/coupons",
  },
  {
    title: "Referrals",
    url: "/referrals",
    icon: IconLink,
    group: "Growth",
  },
  {
    title: "Notifications",
    url: "/general-notifications",
    icon: IconBell,
    group: "Growth",
  },
  {
    title: "Head offices",
    url: "/head-offices",
    icon: IconMapPin,
    group: "Administration",
  },
  {
    title: "Delivery tariffs",
    url: "/delivery-zones",
    icon: IconMapPin,
    group: "Administration",
  },
  {
    title: "App configuration",
    url: "/app-config",
    icon: IconSettings,
    group: "Administration",
  },
  {
    title: "Admin accounts",
    url: "/admin/users",
    icon: IconUserShield,
    group: "Administration",
  },
];

const groupOrder = [
  "Workspace",
  "Operations",
  "People & partners",
  "Finance",
  "Growth",
  "Administration",
];
navigation.sort(
  (a, b) => groupOrder.indexOf(a.group) - groupOrder.indexOf(b.group),
);

export function allowedNavigation(adminType: unknown) {
  return navigation.filter((item) => canAccessAdminScreen(adminType, item.url));
}

export function sidebarNavigation(adminType: unknown) {
  const allowed = allowedNavigation(adminType);
  return allowed
    .filter((item) => !item.parentUrl)
    .map((item) => ({
      ...item,
      children: allowed.filter((child) => child.parentUrl === item.url),
    }));
}

export function navigationForPath(pathname: string) {
  return navigation.find(
    (item) => pathname === item.url || pathname.startsWith(`${item.url}/`),
  );
}

export const adminRoleLabels: Record<string, string> = {
  super: "Super admin",
  regular: "Regular admin",
  customercare: "Customer care",
  verifier: "Verifier",
};
