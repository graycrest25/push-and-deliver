import {
  IconBell,
  IconCar,
  IconCash,
  IconCoin,
  IconDashboard,
  IconGift,
  IconGiftCard,
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
}

export const navigation: NavigationItem[] = [
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
    title: "Restaurant orders",
    url: "/restaurant-orders",
    icon: IconShoppingCart,
    group: "Operations",
  },
  {
    title: "Product orders",
    url: "/product-orders",
    icon: IconShoppingBag,
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
    title: "Riders",
    url: "/riders",
    icon: IconMotorbike,
    group: "People & partners",
  },
  {
    title: "Restaurants",
    url: "/vendors",
    icon: IconTruckDelivery,
    group: "People & partners",
  },
  {
    title: "E-commerce merchants",
    url: "/ecommerce-merchants",
    icon: IconShoppingBag,
    group: "People & partners",
  },
  {
    title: "Withdrawals",
    url: "/withdrawals",
    icon: IconCash,
    group: "Finance",
  },
  { title: "Fees", url: "/fees", icon: IconCoin, group: "Finance" },
  {
    title: "Export rates",
    url: "/export-rates",
    icon: IconPlane,
    group: "Finance",
  },
  { title: "Coupons", url: "/coupons", icon: IconGiftCard, group: "Growth" },
  { title: "Referrals", url: "/referrals", icon: IconGift, group: "Growth" },
  {
    title: "Generated referrals",
    url: "/generated",
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
    title: "Delivery zones",
    url: "/delivery-zones",
    icon: IconMapPin,
    group: "Administration",
  },
  {
    title: "DHL zones",
    url: "/dhl-zones",
    icon: IconWorld,
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

export function allowedNavigation(adminType: unknown) {
  return navigation.filter((item) => canAccessAdminScreen(adminType, item.url));
}

export function navigationForPath(pathname: string) {
  return navigation.find(
    (item) => pathname === item.url || pathname.startsWith(`${item.url}/`),
  );
}

export const adminRoleLabels: Record<string, string> = {
  super: "Super admin",
  regular: "Admin",
  customercare: "Customer care",
  verifier: "Verifier",
};
