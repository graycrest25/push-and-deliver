export type AdminType = "super" | "regular" | "customercare" | "verifier";
const reads = [
  "/reports",
  "/shipment-orders",
  "/support-tickets",
  "/withdrawals",
  "/settings",
];
const operations = [
  ...reads,
  "/users",
  "/ride-hailing",
  "/jobs",
  "/files",
  "/riders",
  "/rider-applications",
  "/pricing-audit",
  "/vendors",
  "/ecommerce-merchants",
  "/dashboard",
  "/fees",
  "/export-rates",
  "/head-offices",
  "/delivery-zones",
  "/dhl-zones",
  "/dhl-local",
  "/coupons",
  "/referrals",
  "/generated",
  "/general-notifications",
  "/payments",
];
export const adminScreens: Record<AdminType, readonly string[]> = {
  super: [
    ...operations,
    "/admin/users",
    "/audit",
    "/analytics-coverage",
    "/app-config",
    "/game-rules",
    "/coupon-redemption-metrics",
    "/weekly-concentration",
    "/rider-weekly-deliveries",
    "/user-activation",
    "/weekly-overview",
  ],
  regular: operations,
  customercare: reads,
  verifier: ["/reports", "/settings", "/rider-applications"],
};
export function isAdminType(value: unknown): value is AdminType {
  return typeof value === "string" && Object.hasOwn(adminScreens, value);
}
export function canAccessAdminScreen(type: unknown, path: string) {
  return (
    isAdminType(type) &&
    adminScreens[type].some(
      (screen) => path === screen || path.startsWith(`${screen}/`),
    )
  );
}
export function adminHome(type: unknown) {
  return type === "verifier"
    ? "/reports"
    : type === "customercare"
      ? "/support-tickets"
      : "/dashboard";
}
export function canOperate(type: unknown) {
  return type === "super" || type === "regular";
}
