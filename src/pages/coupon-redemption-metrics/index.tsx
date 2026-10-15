import { useCurrentUser } from "@/contexts/UserContext";
import { CouponRedemptionMetrics } from "@/components/coupons/coupon-redemption-metrics";

export default function CouponRedemptionMetricsPage() {
  const { adminType } = useCurrentUser();
  if (adminType !== "super")
    return (
      <p>Super admin access is required to view coupon redemption metrics.</p>
    );
  return (
    <div className="min-w-0 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Coupon redemption metrics
        </h1>
        <p className="mt-1 text-muted-foreground">
          Measure redemption for a selected group of issued coupons.
        </p>
      </div>
      <CouponRedemptionMetrics />
    </div>
  );
}
