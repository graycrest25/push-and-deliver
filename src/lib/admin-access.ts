export type AdminType = "super" | "regular" | "customercare" | "verifier";

const customerCareScreens = [
  "/dashboard", "/users", "/riders", "/vendors", "/ecommerce-merchants",
  "/support-tickets", "/restaurant-orders", "/shipment-orders", "/ride-hailing",
  "/coupons", "/product-orders",
];
const regularScreens = [
  ...customerCareScreens, "/referrals", "/withdrawals", "/generated",
  "/general-notifications", "/app-config",
];

export const adminScreens: Record<AdminType, readonly string[]> = {
  super: [...regularScreens, "/admin/users", "/fees", "/export-rates", "/delivery-zones", "/dhl-zones"],
  regular: regularScreens,
  customercare: customerCareScreens,
  verifier: ["/riders"],
};

export function isAdminType(value: unknown): value is AdminType {
  return typeof value === "string" && Object.hasOwn(adminScreens, value);
}

export function canAccessAdminScreen(adminType: unknown, pathname: string): boolean {
  return isAdminType(adminType) && adminScreens[adminType].some(
    (screen) => pathname === screen || pathname.startsWith(`${screen}/`),
  );
}

export function adminHome(adminType: unknown): string {
  return adminType === "verifier" ? "/riders" : "/dashboard";
}
