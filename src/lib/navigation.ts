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
    group: "Audit & review",
  },
  {
    title: "Pricing audit",
    url: "/pricing-audit",
    icon: IconCoin,
    group: "Audit & review",
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
    title: "Payment review",
    url: "/payments",
    icon: IconCash,
    group: "Audit & review",
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
    title: "Support closure history",
    url: "/support-closures",
    icon: IconHeadset,
    group: "Audit & review",
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
    group: "Audit & review",
  },
  {
    title: "Withdrawals",
    url: "/withdrawals",
    icon: IconCash,
    group: "Audit & review",
  },
  { title: "Fees & pricing", url: "/fees", icon: IconCoin, group: "Pricing" },
  {
    title: "International shipment tariffs",
    url: "/export-rates",
    icon: IconPlane,
    group: "Pricing",
  },
  {
    title: "Local shipment tariffs",
    url: "/delivery-zones",
    icon: IconMapPin,
    group: "Pricing",
  },
  {
    title: "Head offices",
    url: "/head-offices",
    icon: IconMapPin,
    group: "Pricing",
  },
  {
    title: "Game rules",
    url: "/game-rules",
    icon: IconStopwatch,
    group: "Configuration",
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
    title: "Promoter links",
    url: "/promoter-links",
    icon: IconLink,
    group: "Growth",
    parentUrl: "/referrals",
  },
  {
    title: "App configuration",
    url: "/app-config",
    icon: IconSettings,
    group: "Configuration",
  },
  {
    title: "Admin accounts",
    url: "/admin/users",
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
    title: "Audit history",
    url: "/audit",
    icon: IconUserShield,
    group: "Audit & review",
  },
];

const groupOrder = [
  "Workspace",
  "Operations",
  "People & partners",
  "Pricing",
  "Audit & review",
  "Growth",
  "Configuration",
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
